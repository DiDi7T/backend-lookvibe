import { UserRoleGuard } from './user-role.guard.js';
//Increible que tocara crea esto a mano, el comando de nest g guard no queria funcionar 
describe('UserRoleGuard', () => {
  it('should be defined', () => {
    const mockReflector = {} as any;
    expect(new UserRoleGuard(mockReflector)).toBeDefined();
  });
});