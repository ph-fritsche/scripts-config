const debugConsole = {
    run: async () => {
        process.stdout.write(`write plain\n`)

        process.stdout.write(`console width: ${process.stdout.columns}\n`)
        process.stdout.write(`write\x1B[33myellow\n`)
        process.stdout.write(`write\x1B[32mgreen\n`)
        process.stdout.write(`reset\x1B[0mcolor\n`)
        process.stdout.write(`write\x1B[38;5;8mgray\n`)
    },
}

module.exports = {
    scripts: {
        debugConsole,
    },
}
