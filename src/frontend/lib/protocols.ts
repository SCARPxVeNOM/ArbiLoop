export interface ProtocolMeta {
    id: string;
    label: string;
    icon: string;
    sourceProjects: string[];
}

const ARBITRUM_PROTOCOLS: ProtocolMeta[] = [
    { id: 'aave-v3', label: 'Aave V3', icon: '/aave-logo.webp', sourceProjects: ['aave-v3'] },
    { id: 'radiant-v2', label: 'Radiant', icon: '/radiant.jpeg', sourceProjects: ['radiant-v2'] },
];

export const ACTIVE_PROTOCOLS: ProtocolMeta[] = ARBITRUM_PROTOCOLS;

export const ENABLED_SOURCE_PROJECTS = new Set(
    ACTIVE_PROTOCOLS.flatMap((protocol) => protocol.sourceProjects),
);

const sourceToAppProjectEntries = ACTIVE_PROTOCOLS.flatMap((protocol) =>
    protocol.sourceProjects.map((sourceProject) => [sourceProject, protocol.id] as const),
);

export const SOURCE_PROJECT_TO_APP_PROJECT = new Map(sourceToAppProjectEntries);

export function normalizeProject(sourceProject: string): string {
    const normalized = SOURCE_PROJECT_TO_APP_PROJECT.get(sourceProject);
    if (normalized) return normalized;
    if (sourceProject === 'aave') return 'aave-v3';
    if (sourceProject === 'radiant') return 'radiant-v2';
    return sourceProject;
}

export function getProtocolMetaByProject(project: string): ProtocolMeta | undefined {
    const normalized = normalizeProject(project);
    return ACTIVE_PROTOCOLS.find((protocol) => protocol.id === normalized);
}

export function getProtocolLabel(project: string): string {
    const fallbackLabels: Record<string, string> = {
        'aave-v3': 'Aave V3',
        'aave': 'Aave V3',
        'radiant-v2': 'Radiant',
        'radiant': 'Radiant',
    };
    return getProtocolMetaByProject(project)?.label || fallbackLabels[project] || project;
}

export function getProtocolIcon(project: string): string | null {
    return getProtocolMetaByProject(project)?.icon || null;
}
