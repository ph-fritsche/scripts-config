export function nullishCoalescing(x?: string) {
    return x ?? 'foo'
}

export function optionalChaining(x: {y?: string}) {
    return x?.y
}
