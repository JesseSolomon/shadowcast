#define PHONG

struct ShadowMatrices {
	mat4x4 view;
	mat4x4 projection;
};

uniform ShadowMatrices customShadowMatrices;
uniform sampler2D customShadowMap;
uniform vec3 customShadowPosition;

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

in vec3 vWorldPosition;
in vec2 vSampleShadowPosition;

#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {
	#include <clipping_planes_fragment>
	vec4 diffuseColor = vec4( diffuse, opacity );
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	// accumulation
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	// modulation
	#include <aomap_fragment>
	
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

	#include <envmap_fragment>
	
	// Use the custom shadow matrices to project the fragment into the shadow camera's view plane
	vec4 transformedShadowPosition = customShadowMatrices.projection * customShadowMatrices.view * vec4(vWorldPosition, 1);

	// Convert the projected vector into a UV coordinate for image sampling
	vec2 samplePosition = (transformedShadowPosition.xy / transformedShadowPosition.w) * 0.5 + 0.5;

	// A temp variable for controlling whether to render shadow, or the default lighting
	vec3 clippedLight = outgoingLight;

	// Clip the sample position into a circle, which also ensures we aren't sampling points outside the shadow cameras frustum
	if (distance(samplePosition, vec2(0.5, 0.5)) <= 0.5) {
		// Sample the shadow map at the sample position
		vec4 sampledTexel = texture2D(customShadowMap, samplePosition.xy);

		// Get this distance from the fragment to the shadow camera
		float baseDistance = distance(vWorldPosition, customShadowPosition);

		// Convert the sampled color into a distance
		float sampledDepth = sampledTexel.r * 30.0;

		// If the fragment is closer to the camera than the sampled depth, render as shadow. We also add a bias to help with rounding errors
		if (baseDistance - sampledDepth < 0.1) {
			clippedLight = vec3(0, 0, 0);
		}
	}

	gl_FragColor = vec4(clippedLight, diffuseColor.a);
	
	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}
