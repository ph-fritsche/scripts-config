export function which(): string {
    // `__filename` will only be available in cjs
    // while `import.meta` will only be available in esm.
    // This hacky workaround allows us to get the location this code is served from
    // no matter if it ends up in a cjs or esm file.
    const file = new Error().stack?.match(/[("](?:file:\/\/)?(.*):\d+:\d+/)?.[1]

    return String(file)
}
