out vec3 vWorldPosition;

void main() {
	vWorldPosition = vec3(modelMatrix * vec4(position, 1));

	gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPosition, 1);
}