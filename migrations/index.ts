import * as migration_20261004_100546_initial from './20261004_100546_initial';

export const migrations = [
  {
    up: migration_20261004_100546_initial.up,
    down: migration_20261004_100546_initial.down,
    name: '20261004_100546_initial'
  },
];
