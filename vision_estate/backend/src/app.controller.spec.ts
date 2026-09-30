import { describe, it, expect } from 'vitest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
describe('AppController', () => {
  it('returns the service greeting', () => {
    const controller = new AppController(new AppService());
    expect(controller.getHello()).toBe('Hello World!');
  });
});
