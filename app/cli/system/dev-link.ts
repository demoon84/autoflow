import * as shared from "../shared";
const {path, REPO_ROOT, out, fail, parseArgs, firstFlag, hasFlag, registerCoreLink, coreRegistryPath, coreBundledShareRoot} = shared;

function printDevLinkUsage(): void {
    out(`Usage: autoflow dev-link [core-root] [--name <name>] [--share-root <dir>] [--no-active]

개발 중인 Autoflow core를 사용자 전역 registry에 등록합니다.
대상 프로젝트 보드는 이 registry를 통해 전역 core를 참조하므로, core 수정 뒤 보드별 파일 업그레이드를 반복하지 않아도 됩니다.
--share-root를 생략하면 <core-root>/install/share를 직접 참조합니다.`);
}

export function devLinkProject(args: string[]): void {
    const parsed = parseArgs(args);
    if (hasFlag(parsed, "help") || args.includes("-h")) {
        printDevLinkUsage();
        return;
    }

    const coreRoot = path.resolve(parsed.positionals[0] || REPO_ROOT);
    const shareRoot = path.resolve(firstFlag(parsed, "share-root") || coreBundledShareRoot(coreRoot));
    const name = firstFlag(parsed, "name") || "dev";
    const active = !hasFlag(parsed, "no-active");

    try {
        const entry = registerCoreLink({
            name,
            kind: "dev",
            coreRoot,
            shareRoot,
            active,
        });
        out("status=ok");
        out("mode=dev-link");
        out(`name=${entry.name}`);
        out(`active=${active ? "true" : "false"}`);
        out(`core_root=${entry.coreRoot}`);
        out(`runtime_root=${entry.runtimeRoot}`);
        out(`install_root=${entry.installRoot}`);
        out(`share_root=${entry.shareRoot}`);
        out(`core_version=${entry.version}`);
        out(`registry=${coreRegistryPath()}`);
    } catch (error) {
        fail(error instanceof Error ? error.message : String(error));
    }
}
