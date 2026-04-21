import { loadEnvFile, getDockerImage, runCommand } from "./sandbox-utils.mjs";

loadEnvFile();

const image = getDockerImage();
console.log(`Building Docker sandbox image: ${image}`);

await runCommand("docker", ["build", "-f", "sandbox/Dockerfile", "-t", image, "."], {
  stdio: "inherit",
});

console.log(`Built ${image}`);
