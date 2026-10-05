import { vi } from 'vitest';
import { UserService } from './users.service.js';

describe('UsersService', () => {
  let service: UserService;

  beforeEach(() => {
    const repository = {
      createQueryBuilder: vi.fn(),
      find: vi.fn(),
      findOneBy: vi.fn(),
      preload: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    };
    service = new UserService(repository as never);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
