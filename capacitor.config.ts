import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.example.skillgomoku",
  appName: "Skill Gomoku",
  webDir: "dist",
  server: {
    androidScheme: "http",
    cleartext: true
  }
};

export default config;
