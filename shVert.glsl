#version 300 es

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in vec4 a_color;
layout(location = 3) in vec2 a_texCoord;


out vec3 vFragPos;
out vec3 vNormal;
out vec3 lightingColor; // resulting color at each vertex, to fragment shader

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;

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

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;

uniform int u_renderingMode; 

void main() {
    vec4 worldPos = u_model * vec4(a_position, 1.0);
    vFragPos = worldPos.xyz;

    mat3 normalMat = mat3(transpose(inverse(u_model)));
    vec3 N = normalize(normalMat * a_normal);
    vNormal = N;

    // ambient
    vec3 rgb = material.diffuse;
    vec3 ambient = light.ambient * rgb;

    // diffuse
    vec3 L = normalize(light.position - vFragPos);
    float ndotl = max(dot(N, L), 0.0);
    vec3 diffuse = light.diffuse * ndotl * rgb;

    // specular
    vec3 V = normalize(u_viewPos - vFragPos);
    vec3 R = reflect(-L, N);
    float spec = (ndotl > 0.0) ? pow(max(dot(V, R), 0.0), material.shininess) : 0.0;
    vec3 specular = light.specular * material.specular * spec;  

    // ambient + diffuse + specular
    lightingColor = ambient + diffuse + specular;

    gl_Position = u_projection * u_view * worldPos;
} 