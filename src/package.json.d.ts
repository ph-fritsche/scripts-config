export interface PackageJson {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    main?: string
    module?: string
    types?: string
    exports?: Record<string, string | Record<string, string>>
    typesVersions?: Record<string, Record<string, string[]>>
}
