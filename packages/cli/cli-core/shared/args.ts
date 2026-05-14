import {fs, path, type ParsedArgs} from "./context";

export function parseArgs(argv: string[]): ParsedArgs {
    const positionals: string[] = [];
    const flags = new Map<string, string[]>();
    const booleans = new Set<string>();

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] || "";
        if (!arg.startsWith("--") || arg === "--") {
            positionals.push(arg);
            continue;
        }

        const eq = arg.indexOf("=");
        if (eq > 2) {
            const key = arg.slice(2, eq);
            const value = arg.slice(eq + 1);
            flags.set(key, [...(flags.get(key) || []), value]);
            continue;
        }

        const key = arg.slice(2);
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("--")) {
            flags.set(key, [...(flags.get(key) || []), next]);
            index += 1;
            continue;
        }
        booleans.add(key);
    }

    return {positionals, flags, booleans};
}

export function firstFlag(args: ParsedArgs, key: string): string | undefined {
    return args.flags.get(key)?.[0];
}

export function allFlags(args: ParsedArgs, key: string): string[] {
    return args.flags.get(key) || [];
}

export function hasFlag(args: ParsedArgs, key: string): boolean {
    return args.booleans.has(key) || args.flags.has(key);
}

export function readStdin(): string {
    if (process.stdin.isTTY) {
        return "";
    }
    try {
        return fs.readFileSync(0, "utf8");
    } catch {
        return "";
    }
}

export function readRequestText(args: ParsedArgs, flagName: string): string {
    const fromFile = firstFlag(args, "from-file");
    if (fromFile) {
        return fs.readFileSync(path.resolve(fromFile), "utf8").trimEnd();
    }
    const direct = firstFlag(args, flagName);
    if (direct !== undefined) {
        return direct;
    }
    return readStdin().trimEnd();
}
