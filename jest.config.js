module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    coverageDirectory: "./coverage/",
    collectCoverage: true,
    collectCoverageFrom: ["src/**/*.ts"],
    testTimeout: 10000
  };
  