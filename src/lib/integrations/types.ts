export type IntegrationProvider = 
  | 'github' 
  | 'gitlab' 
  | 'bitbucket' 
  | 'slack' 
  | 'discord' 
  | 'linear' 
  | 'jira' 
  | 'notion';

export type IntegrationCategory = 'Source Control' | 'Communication' | 'Project Management';

export interface IntegrationConfig {
  provider: IntegrationProvider;
  name: string;
  category: IntegrationCategory;
  description: string;
  status: 'connected' | 'disconnected';
  token?: string;
  webhookUrl?: string;
  targetWorkspace?: string;
  lastSync?: string;
  connectedAccount?: string;
}
