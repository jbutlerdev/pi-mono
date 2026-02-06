"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGitUrl = parseGitUrl;
const hosted_git_info_1 = __importDefault(require("hosted-git-info"));
function splitRef(url) {
    var _a, _b;
    const scpLikeMatch = url.match(/^git@([^:]+):(.+)$/);
    if (scpLikeMatch) {
        const pathWithMaybeRef = (_a = scpLikeMatch[2]) !== null && _a !== void 0 ? _a : "";
        const refSeparator = pathWithMaybeRef.indexOf("@");
        if (refSeparator < 0)
            return { repo: url };
        const repoPath = pathWithMaybeRef.slice(0, refSeparator);
        const ref = pathWithMaybeRef.slice(refSeparator + 1);
        if (!repoPath || !ref)
            return { repo: url };
        return {
            repo: `git@${(_b = scpLikeMatch[1]) !== null && _b !== void 0 ? _b : ""}:${repoPath}`,
            ref,
        };
    }
    if (url.includes("://")) {
        try {
            const parsed = new URL(url);
            const pathWithMaybeRef = parsed.pathname.replace(/^\/+/, "");
            const refSeparator = pathWithMaybeRef.indexOf("@");
            if (refSeparator < 0)
                return { repo: url };
            const repoPath = pathWithMaybeRef.slice(0, refSeparator);
            const ref = pathWithMaybeRef.slice(refSeparator + 1);
            if (!repoPath || !ref)
                return { repo: url };
            parsed.pathname = `/${repoPath}`;
            return {
                repo: parsed.toString().replace(/\/$/, ""),
                ref,
            };
        }
        catch (_c) {
            return { repo: url };
        }
    }
    const slashIndex = url.indexOf("/");
    if (slashIndex < 0) {
        return { repo: url };
    }
    const host = url.slice(0, slashIndex);
    const pathWithMaybeRef = url.slice(slashIndex + 1);
    const refSeparator = pathWithMaybeRef.indexOf("@");
    if (refSeparator < 0) {
        return { repo: url };
    }
    const repoPath = pathWithMaybeRef.slice(0, refSeparator);
    const ref = pathWithMaybeRef.slice(refSeparator + 1);
    if (!repoPath || !ref) {
        return { repo: url };
    }
    return {
        repo: `${host}/${repoPath}`,
        ref,
    };
}
function parseGenericGitUrl(url) {
    var _a, _b;
    const { repo: repoWithoutRef, ref } = splitRef(url);
    let repo = repoWithoutRef;
    let host = "";
    let path = "";
    const scpLikeMatch = repoWithoutRef.match(/^git@([^:]+):(.+)$/);
    if (scpLikeMatch) {
        host = (_a = scpLikeMatch[1]) !== null && _a !== void 0 ? _a : "";
        path = (_b = scpLikeMatch[2]) !== null && _b !== void 0 ? _b : "";
    }
    else if (repoWithoutRef.startsWith("https://") ||
        repoWithoutRef.startsWith("http://") ||
        repoWithoutRef.startsWith("ssh://")) {
        try {
            const parsed = new URL(repoWithoutRef);
            host = parsed.hostname;
            path = parsed.pathname.replace(/^\/+/, "");
        }
        catch (_c) {
            return null;
        }
    }
    else {
        const slashIndex = repoWithoutRef.indexOf("/");
        if (slashIndex < 0) {
            return null;
        }
        host = repoWithoutRef.slice(0, slashIndex);
        path = repoWithoutRef.slice(slashIndex + 1);
        if (!host.includes(".") && host !== "localhost") {
            return null;
        }
        repo = `https://${repoWithoutRef}`;
    }
    const normalizedPath = path.replace(/\.git$/, "").replace(/^\/+/, "");
    if (!host || !normalizedPath || normalizedPath.split("/").length < 2) {
        return null;
    }
    return {
        type: "git",
        repo,
        host,
        path: normalizedPath,
        ref,
        pinned: Boolean(ref),
    };
}
/**
 * Parse any git URL (SSH or HTTPS) into a GitSource.
 */
function parseGitUrl(source) {
    var _a, _b;
    const url = source.startsWith("git:") ? source.slice(4).trim() : source;
    const split = splitRef(url);
    const hostedCandidates = [split.ref ? `${split.repo}#${split.ref}` : undefined, url].filter((value) => Boolean(value));
    for (const candidate of hostedCandidates) {
        const info = hosted_git_info_1.default.fromUrl(candidate);
        if (info) {
            if (split.ref && ((_a = info.project) === null || _a === void 0 ? void 0 : _a.includes("@"))) {
                continue;
            }
            const useHttpsPrefix = !split.repo.startsWith("http://") &&
                !split.repo.startsWith("https://") &&
                !split.repo.startsWith("ssh://") &&
                !split.repo.startsWith("git@");
            return {
                type: "git",
                repo: useHttpsPrefix ? `https://${split.repo}` : split.repo,
                host: info.domain || "",
                path: `${info.user}/${info.project}`.replace(/\.git$/, ""),
                ref: info.committish || split.ref || undefined,
                pinned: Boolean(info.committish || split.ref),
            };
        }
    }
    const httpsCandidates = [split.ref ? `https://${split.repo}#${split.ref}` : undefined, `https://${url}`].filter((value) => Boolean(value));
    for (const candidate of httpsCandidates) {
        const info = hosted_git_info_1.default.fromUrl(candidate);
        if (info) {
            if (split.ref && ((_b = info.project) === null || _b === void 0 ? void 0 : _b.includes("@"))) {
                continue;
            }
            return {
                type: "git",
                repo: `https://${split.repo}`,
                host: info.domain || "",
                path: `${info.user}/${info.project}`.replace(/\.git$/, ""),
                ref: info.committish || split.ref || undefined,
                pinned: Boolean(info.committish || split.ref),
            };
        }
    }
    return parseGenericGitUrl(url);
}
