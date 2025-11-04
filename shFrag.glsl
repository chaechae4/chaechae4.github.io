#version 300 es

precision highp float;

struct Material {
    vec3 diffuse;
    vec3 specular;
    float shininess;
};

struct Light {
    vec3 position;
    vec3 ambient;
    vec3 diffuse;
    vec3 specular;
};

in vec3 vFragPos;
in vec3 vNormal;
in vec3 lightingColor;
out vec4 FragColor;

uniform vec3 u_viewPos;

uniform Material material;
uniform Light light;
uniform int u_renderingMode;

void main() {
    if (u_renderingMode == 0) {
        FragColor = vec4(lightingColor, 1.0);
    }
    else {
        vec3 N = normalize(vNormal);
        vec3 L = normalize(light.position - vFragPos);
        vec3 V = normalize(u_viewPos - vFragPos);
        vec3 R = reflect(-L, N);

        float ndotl = max(dot(N, L), 0.0);

        vec3 ambient  = light.ambient  * material.diffuse;
        vec3 diffuse  = light.diffuse  * material.diffuse * ndotl;
        float spec    = (ndotl > 0.0) ? pow(max(dot(V, R), 0.0), material.shininess) : 0.0;
        vec3 specular = light.specular * material.specular * spec;

        FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
}