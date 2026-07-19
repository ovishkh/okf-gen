import { type Server } from "node:http";
export interface ViewerOptions {
    directory: string;
    host?: string;
    port?: number;
    openBrowser?: boolean;
}
export interface ViewerConcept {
    id: string;
    title: string;
    description: string;
    type: string;
    tags: string[];
    resource?: string;
    updatedAt?: string;
    html: string;
}
export interface ViewerData {
    title: string;
    directory: string;
    concepts: ViewerConcept[];
    edges: Array<{
        source: string;
        target: string;
    }>;
}
export interface ViewerServer {
    url: string;
    server: Server;
}
export declare function buildViewerData(directory: string): Promise<ViewerData>;
export declare function startViewer(options: ViewerOptions): Promise<ViewerServer>;
export declare function viewerHtml(dataJson: string): string;
//# sourceMappingURL=viewer.d.ts.map