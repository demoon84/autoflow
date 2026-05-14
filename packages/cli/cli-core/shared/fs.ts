import {fs, path} from "./context";

export function ensureDir(dir: string): void {
    fs.mkdirSync(dir, {recursive: true});
}

export function writeFile(file: string, content: string, force = true): void {
    ensureDir(path.dirname(file));
    if (!force && fs.existsSync(file)) {
        return;
    }
    fs.writeFileSync(file, content);
}

export function writeFileAtomic(file: string, content: string): void {
    ensureDir(path.dirname(file));
    const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, content);
    fs.renameSync(tempFile, file);
}

export function copyTree(src: string, dest: string, options: {overwrite: boolean; skipShell: boolean}): void {
    if (!fs.existsSync(src)) {
        return;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        ensureDir(dest);
        for (const name of fs.readdirSync(src)) {
            if (name === "node_modules" || name === ".git") {
                continue;
            }
            copyTree(path.join(src, name), path.join(dest, name), options);
        }
        return;
    }

    if (options.skipShell && src.endsWith(".sh")) {
        return;
    }
    if (!options.overwrite && fs.existsSync(dest)) {
        return;
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    if (src.endsWith(".ts") || src.endsWith(".js")) {
        try {
            fs.chmodSync(dest, 0o755);
        } catch {
            // chmod is best-effort on platforms that support executable bits.
        }
    }
}

export function walkMarkdownFiles(dir: string, files: string[] = []): string[] {
    if (!fs.existsSync(dir)) {
        return files;
    }
    for (const name of fs.readdirSync(dir)) {
        if (name === ".git" || name === "node_modules") {
            continue;
        }
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walkMarkdownFiles(full, files);
        } else if (name.endsWith(".md")) {
            files.push(full);
        }
    }
    return files;
}

export function readSingleLine(file: string): string {
    try {
        return fs.readFileSync(file, "utf8").replace(/[\r\n]+/g, "");
    } catch {
        return "";
    }
}
