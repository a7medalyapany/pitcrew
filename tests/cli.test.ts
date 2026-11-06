import { describe, expect, it } from 'vitest';
import { CLI_NAME, PROJECT_NAME } from '../src/identity.js';

describe('project identity', () => {
  it('uses Pitcrew as the project name and CLI command', () => {
    expect(PROJECT_NAME).toBe('Pitcrew');
    expect(CLI_NAME).toBe('pitcrew');
  });
});
