/**
 * The main app method, which runs after all assets have been loaded
 * 
 * @param {{ shaders: string[], scene: THREE.Group }} config
 */
 function app(config) {
	// Setup the environment
	const scene = new THREE.Scene();
	const renderer = new THREE.WebGLRenderer();
	const raycaster = new THREE.Raycaster();
	const mouse = new THREE.Vector2();
	
	renderer.shadowMap.enabled = true;
	renderer.physicallyCorrectLights = true;
	renderer.setSize(innerWidth, innerHeight);
	document.body.appendChild(renderer.domElement);

	addEventListener("resize", () => {
		renderer.setSize(innerWidth, innerHeight);
		mainCamera.aspect = innerWidth / innerHeight;
		mainCamera.updateProjectionMatrix();
	});

	addEventListener("mousemove", event => {
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	});

	// Create the base scene
	const mainCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.01, 100);
	const shadowCamera = new THREE.PerspectiveCamera(35, 1, 0.01, 30);
	const shadowTarget = new THREE.WebGLRenderTarget(512, 512, { format: THREE.RGBFormat });
	const light = new THREE.DirectionalLight(0xFFFFFF, 2.4);
	const controls = new THREE.OrbitControls(mainCamera, renderer.domElement);

	light.position.set(-1, 3, -0.5);
	light.castShadow = true;
	light.shadow.mapSize.width = 1080;
	light.shadow.mapSize.height = 1080;

	scene.add(light);

	shadowCamera.position.set(0, 5, 0);
	shadowCamera.lookAt(0, 0, 0);

	shadowTarget.setSize(512, 512);

	mainCamera.position.set(-5, 5, 5);
	mainCamera.lookAt(0, 0, 0);

	shadowCamera.updateProjectionMatrix();
    shadowCamera.updateMatrixWorld();
    shadowCamera.updateWorldMatrix();

	// A custom material which uses THREE's default phong shader as a base for our custom lighting
	const baseMaterial = new THREE.ShaderMaterial({
		vertexShader: config.shaders[0], // public/fx_vertex.glsl
		fragmentShader: config.shaders[1], // public/fx_fragment.glsl
		lights: true,
		uniforms: {
			// Include the default phong uniforms so we don't have to build all the lighting
			...THREE.UniformsUtils.clone(THREE.ShaderLib.phong.uniforms),
			// Points to a texture where each pixel is the distance to the fragment
			customShadowMap: {
				value: shadowTarget.texture
			},
			// The position of our shadowcast light
			customShadowPosition: {
				value: shadowCamera.position
			},
			// The matrices for projecting vectors into our shadow light
			customShadowMatrices: {
				value: {
					projection: shadowCamera.projectionMatrix,
					view: shadowCamera.matrixWorldInverse
				}
			}
		}
	});

	// A custom material for render depth as a texture
	// THREE.js has one, but I couldn't get it to work
	const depthMaterial = new THREE.ShaderMaterial({
		vertexShader: config.shaders[2],
		fragmentShader: config.shaders[3]
	});

	// A list of all THREE.Mesh objects in the scene, for swapping materials on the fly
	const objectReference = [];

	/**
	 * Index and update settings on every object in the scene
	 * 
	 * @param {THREE.Object3D} object
	 */
	function applyShaders(object) {
		if (object instanceof THREE.Mesh) {
			objectReference.push(object);

			object.receiveShadow = true;
			object.castShadow = true;
		}

		for (let child of object.children) {
			applyShaders(child);
		}
	}

	config.scene.position.set(0, 0, 0);

	scene.add(config.scene);

	applyShaders(config.scene);

	/**
	 * The method responsible for updated the objects, and rendering the scene.
	 * Is called once per animation frame.
	 */
	function render() {
		// Update user controls
		controls.update();

		shadowCamera.position.copy(mainCamera.position.clone().sub(new THREE.Vector3(0, 5, 0)).normalize().multiply(new THREE.Vector3(-2, -2, -2)).add(new THREE.Vector3(0, 5, 0)));

		raycaster.setFromCamera(mouse, mainCamera);

		let intersections = raycaster.intersectObjects(objectReference);

		if (intersections.length) shadowCamera.lookAt(intersections.sort((a, b) => (b?.point.distanceTo(mainCamera.position) ?? 0) - (a?.point.distanceTo(mainCamera.position) ?? 0))[0].point);
		
		shadowCamera.updateWorldMatrix();

		light.position.x = Math.sin(Date.now() / 1000);

		// Set every object in the scene to use the `depthMaterial`
		objectReference.forEach(obj => obj.material = depthMaterial);

		// Render the shadow camera to get the depth texture
		renderer.setRenderTarget(shadowTarget);
		renderer.render(scene, shadowCamera);

		// Set every object in the scene to use the `baseMaterial`
		objectReference.forEach(obj => obj.material = baseMaterial);

		// Render the main camera
		renderer.setRenderTarget(null);
		renderer.render(scene, mainCamera);

		requestAnimationFrame(render);
	}

	requestAnimationFrame(render);
}

// Load assets then start the app
Promise.all([ fetch("/fx_vertex.glsl"), fetch("/fx_fragment.glsl"), fetch("/depth_vertex.glsl"), fetch("/depth_fragment.glsl") ]) // fetch both the shaders
.then(requests => Promise.all(requests.map(request => request.text()))) // convert the fetch responses to strings
.then(shaders => ({ shaders: shaders })) // Convert the string array to a config object
.then(config => new Promise(resolve => {
	const loader = new THREE.GLTFLoader();

	loader.load("/environment.glb", gltf => resolve({ ...config, scene: gltf.scene })); // Use THREE's GLTFLoader to load the scene, and insert it into the config
}))
.then(app);