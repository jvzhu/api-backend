import request from 'supertest';
import { User } from '../../src/models/User';
import { app } from '../helpers/test-app';

describe('API backend integration flows', () => {
  const registerUser = async (email = 'user@example.com', password = 'StrongPass1') =>
    request(app).post('/api/auth/register').send({
      name: 'User Example',
      email,
      password,
    });

  it('supports auth lifecycle and the me endpoint', async () => {
    const registerResponse = await registerUser();

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.refreshToken).toEqual(expect.any(String));

    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ' + registerResponse.body.accessToken);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.user.email).toBe('user@example.com');

    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: registerResponse.body.refreshToken });

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).not.toBe(registerResponse.body.refreshToken);

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer ' + refreshResponse.body.accessToken)
      .send({ refreshToken: refreshResponse.body.refreshToken });

    expect(logoutResponse.status).toBe(204);
  });

  it('supports admin user management and task CRUD flows', async () => {
    await registerUser('admin@example.com');

    const admin = await User.findOneAndUpdate(
      { email: 'admin@example.com' },
      { role: 'admin' },
      { returnDocument: 'after' },
    );
    expect(admin).not.toBeNull();

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'StrongPass1',
    });

    const createUserResponse = await request(app)
      .post('/api/users')
      .set('Authorization', 'Bearer ' + adminLogin.body.accessToken)
      .send({
        name: 'Task Owner',
        email: 'owner@example.com',
        password: 'StrongPass1',
        profile: { bio: 'Owns tasks', timezone: 'UTC' },
      });

    expect(createUserResponse.status).toBe(201);
    const createdUserId = createUserResponse.body.user.id;

    const listUsersResponse = await request(app)
      .get('/api/users?page=1&limit=10')
      .set('Authorization', 'Bearer ' + adminLogin.body.accessToken);

    expect(listUsersResponse.status).toBe(200);
    expect(listUsersResponse.body.pagination.total).toBe(2);

    const ownerLogin = await request(app).post('/api/auth/login').send({
      email: 'owner@example.com',
      password: 'StrongPass1',
    });

    const createTaskResponse = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer ' + ownerLogin.body.accessToken)
      .send({
        title: 'Write integration tests',
        description: 'Cover auth and task flows',
        priority: 'high',
      });

    expect(createTaskResponse.status).toBe(201);
    const taskId = createTaskResponse.body.task.id;

    const listTasksResponse = await request(app)
      .get('/api/tasks?priority=high&sortBy=createdAt&order=desc&page=1&limit=10')
      .set('Authorization', 'Bearer ' + ownerLogin.body.accessToken);

    expect(listTasksResponse.status).toBe(200);
    expect(listTasksResponse.body.data).toHaveLength(1);

    const updateTaskResponse = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', 'Bearer ' + ownerLogin.body.accessToken)
      .send({ status: 'in-progress', dueDate: '2030-01-01T00:00:00.000Z' });

    expect(updateTaskResponse.status).toBe(200);
    expect(updateTaskResponse.body.task.status).toBe('in-progress');

    const completeTaskResponse = await request(app)
      .patch(`/api/tasks/${taskId}/complete`)
      .set('Authorization', 'Bearer ' + ownerLogin.body.accessToken);

    expect(completeTaskResponse.status).toBe(200);
    expect(completeTaskResponse.body.task.status).toBe('completed');

    const profileResponse = await request(app)
      .get(`/api/users/${createdUserId}/profile`)
      .set('Authorization', 'Bearer ' + ownerLogin.body.accessToken);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.profile.taskSummary.completed).toBe(1);

    const deleteTaskResponse = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', 'Bearer ' + ownerLogin.body.accessToken);

    expect(deleteTaskResponse.status).toBe(204);

    const deleteUserResponse = await request(app)
      .delete(`/api/users/${createdUserId}`)
      .set('Authorization', 'Bearer ' + adminLogin.body.accessToken);

    expect(deleteUserResponse.status).toBe(204);
  });

  it('exposes health and OpenAPI documentation endpoints', async () => {
    const healthResponse = await request(app).get('/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body.status).toBe('ok');

    const docsResponse = await request(app).get('/docs.json');
    expect(docsResponse.status).toBe(200);
    expect(docsResponse.body.openapi).toBe('3.0.3');
  });
});
