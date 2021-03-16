in vec3 vWorldPosition;

// #include <packing>

void main() {
	float dist = distance(vWorldPosition, cameraPosition) / 30.0;

	gl_FragColor = vec4(dist, dist, dist, 1.0);
}