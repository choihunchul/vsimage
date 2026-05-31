import * as fs from 'fs';
import * as path from 'path';

export type MessageBundle = Record<string, string>;

function readBundle(filePath: string): MessageBundle {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as MessageBundle;
}

export function resolveLanguageId(language: string): string {
    const normalized = (language || 'en').toLowerCase().replace('_', '-');
    return normalized.split('-')[0] || 'en';
}

export function loadMessageBundle(extensionPath: string, language: string): MessageBundle {
    const l10nDir = path.join(extensionPath, 'media', 'l10n');
    const base = readBundle(path.join(l10nDir, 'en.json'));
    const lang = resolveLanguageId(language);

    if (lang === 'en') {
        return base;
    }

    const localizedPath = path.join(l10nDir, `${lang}.json`);
    if (!fs.existsSync(localizedPath)) {
        return base;
    }

    return { ...base, ...readBundle(localizedPath) };
}

export function loadPackageNls(extensionPath: string, language: string): MessageBundle {
    const base = readBundle(path.join(extensionPath, 'package.nls.json'));
    const lang = resolveLanguageId(language);

    if (lang === 'en') {
        return base;
    }

    const localizedPath = path.join(extensionPath, `package.nls.${lang}.json`);
    if (!fs.existsSync(localizedPath)) {
        return base;
    }

    return { ...base, ...readBundle(localizedPath) };
}

export function formatMessage(template: string, replacements?: Record<string, string>): string {
    if (!replacements) {
        return template;
    }

    return Object.entries(replacements).reduce(
        (result, [key, value]) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), value),
        template
    );
}

export function t(bundle: MessageBundle, key: string, replacements?: Record<string, string>): string {
    return formatMessage(bundle[key] ?? key, replacements);
}
