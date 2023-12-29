module.exports = {
    verbose: true,
    collectCoverage: true,
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
    ],
    testMatch: [
        '<rootDir>/test/**/*.{js,jsx,ts,tsx}',
    ],
    testPathIgnorePatterns: [
        '/_.*(?<!.test.[jt]sx?)$',
    ],
    transform: {
        '^.+\\.(t|j)sx?$': '@swc/jest',
    },
    transformIgnorePatterns: [
    ],
    setupFiles: [
        '<rootDir>/test/_setup.ts',
    ],
}
