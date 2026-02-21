export interface ProtocolMeta {
    id: string;
    label: string;
    icon: string;
    sourceProjects: string[];
}

const ARBITRUM_PROTOCOLS: ProtocolMeta[] = [
    // Keep the internal id `kinza-finance` for compatibility with existing app logic.
    { id: 'kinza-finance', label: 'Aave V3', icon: '/kinza.png', sourceProjects: ['aave-v3'] },
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
    return SOURCE_PROJECT_TO_APP_PROJECT.get(sourceProject) || sourceProject;
}

export function getProtocolMetaByProject(project: string): ProtocolMeta | undefined {
    const normalized = normalizeProject(project);
    return ACTIVE_PROTOCOLS.find((protocol) => protocol.id === normalized);
}

export function getProtocolLabel(project: string): string {
    const fallbackLabels: Record<string, string> = {
        'kinza-finance': 'Aave V3',
        'radiant-v2': 'Radiant',
    };
    return getProtocolMetaByProject(project)?.label || fallbackLabels[project] || project;
}

export function getProtocolIcon(project: string): string | null {
    return getProtocolMetaByProject(project)?.icon || null;
}
