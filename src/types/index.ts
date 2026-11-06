export type AppView = 'player' | 'admin';

export interface AppState {
  currentView: AppView;
}

export * from './quiz';
export * from './lead';
export * from './storage';
export * from './campaign';
