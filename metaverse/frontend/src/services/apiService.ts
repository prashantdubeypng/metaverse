import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: `${API_BASE_URL}/api/v1`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const response = await this.api.post('/login', { username, password });
    return response.data;
  }

  async register(username: string, password: string, type: 'Admin' | 'User') {
    const response = await this.api.post('/signup', { username, password, type });
    return response.data;
  }

  // User endpoints
  async updateMetadata(avatarId: string) {
    const response = await this.api.post('/user/metadata', { avatarId });
    return response.data;
  }

  async getUserSpaces() {
    const response = await this.api.get('/user/spaces');
    return response.data;
  }

  // Space endpoints
  async createSpace(name: string, dimensions: string, mapId?: string) {
    const response = await this.api.post('/space', { name, dimensions, mapId });
    return response.data;
  }

  async getSpaces() {
    const response = await this.api.get('/space/all');
    return response.data;
  }

  async getSpaceById(spaceId: string) {
    const response = await this.api.get(`/space/${spaceId}`);
    return response.data;
  }

  async deleteSpace(spaceId: string) {
    const response = await this.api.delete(`/space/${spaceId}`);
    return response.data;
  }

  async addElementToSpace(spaceId: string, elementId: string, x: string, y: string) {
    const response = await this.api.post('/space/element', { spaceId, elementId, x, y });
    return response.data;
  }

  async deleteElementFromSpace(elementId: string) {
    const response = await this.api.delete('/space/element', { data: { id: elementId } });
    return response.data;
  }

  // Element endpoints
  async getElements() {
    const response = await this.api.get('/elements');
    return response.data;
  }

  // Avatar endpoints
  async getAvatars() {
    const response = await this.api.get('/avatars');
    return response.data;
  }

  // Map endpoints
  async getMaps() {
    const response = await this.api.get('/map/all');
    return response.data;
  }

  async getMapById(mapId: string) {
    const response = await this.api.get(`/map/${mapId}`);
    return response.data;
  }

  async createMap(name: string, width: number, height: number, thumbnail?: string) {
    const response = await this.api.post('/map/create', { name, width, height, thumbnail });
    return response.data;
  }

  async addElementToMap(mapId: string, elementId: string, x: number, y: number) {
    const response = await this.api.post(`/map/${mapId}/elements`, { elementId, x, y });
    return response.data;
  }

  async updateElementPosition(mapElementId: string, x: number, y: number) {
    const response = await this.api.put(`/map/elements/${mapElementId}`, { x, y });
    return response.data;
  }

  async removeElementFromMap(mapElementId: string) {
    const response = await this.api.delete(`/map/elements/${mapElementId}`);
    return response.data;
  }

  async deleteMap(mapId: string) {
    const response = await this.api.delete(`/map/${mapId}`);
    return response.data;
  }

  // Admin endpoints
  async createElement(imageurl: string, width: string, height: string, isStatic: boolean) {
    const response = await this.api.post('/admin/element', { imageurl, width, height, static: isStatic });
    return response.data;
  }

  async updateElement(elementId: string, imageurl: string) {
    const response = await this.api.put(`/admin/element/${elementId}`, { imageurl });
    return response.data;
  }

  async createAvatar(name: string, imageurl: string) {
    const response = await this.api.post('/admin/avatar', { name, imageurl });
    return response.data;
  }

  // async createMap(name: string, width: number, height: number, thumbnail?: string) {
  //   const response = await this.api.post('/map/create', { name, width, height, thumbnail });
  //   return response.data;
  // }

  // Chat endpoints
  async getChatrooms(spaceId: string) {
    const response = await this.api.get(`/chatroom/rooms?spaceId=${spaceId}`);
    return response.data;
  }

  async createChatroom(roomid: string, name: string, description?: string, isPrivate?: boolean) {
    const response = await this.api.post('/chatroom/create', { 
      roomid, 
      name, 
      description, 
      isPrivate 
    });
    return response.data;
  }

  async joinChatroom(chatroomId: string, message?: string) {
    const response = await this.api.post('/chatroom/join', { chatroomId, message });
    return response.data;
  }

  async leaveChatroom(chatroomId: string) {
    const response = await this.api.post('/chatroom/leave', { chatroomId });
    return response.data;
  }

  async getChatroomDetails(chatroomId: string) {
    const response = await this.api.get(`/chatroom/${chatroomId}`);
    return response.data;
  }

  async updateChatroom(chatroomId: string, name?: string, description?: string, isPrivate?: boolean) {
    const response = await this.api.put(`/chatroom/${chatroomId}`, { name, description, isPrivate });
    return response.data;
  }

  async deleteChatroom(chatroomId: string) {
    const response = await this.api.delete(`/chatroom/${chatroomId}`);
    return response.data;
  }

  // Join Request endpoints
  async getPendingJoinRequests(chatroomId: string) {
    const response = await this.api.get(`/chatroom/${chatroomId}/requests`);
    return response.data;
  }

  async approveJoinRequest(chatroomId: string, requestId: string, message?: string) {
    const response = await this.api.post(`/chatroom/${chatroomId}/approve`, { requestId, message });
    return response.data;
  }

  async rejectJoinRequest(chatroomId: string, requestId: string, message?: string) {
    const response = await this.api.post(`/chatroom/${chatroomId}/reject`, { requestId, message });
    return response.data;
  }

  // Invitation endpoints
  async inviteUserToChatroom(chatroomId: string, userId: string, message?: string, expiresInHours?: number) {
    const response = await this.api.post(`/chatroom/${chatroomId}/invite`, { 
      userId, 
      message, 
      expiresInHours 
    });
    return response.data;
  }

  async getUserInvitations() {
    const response = await this.api.get('/user/invitations');
    return response.data;
  }

  async acceptInvitation(invitationId: string) {
    const response = await this.api.post(`/invitation/${invitationId}/accept`);
    return response.data;
  }

  async declineInvitation(invitationId: string) {
    const response = await this.api.post(`/invitation/${invitationId}/decline`);
    return response.data;
  }

  // Member management endpoints
  async promoteMember(chatroomId: string, userId: string, newRole: 'ADMIN' | 'MEMBER') {
    const response = await this.api.post(`/chatroom/${chatroomId}/member/promote`, { 
      userId, 
      newRole 
    });
    return response.data;
  }

  async demoteMember(chatroomId: string, userId: string) {
    const response = await this.api.post(`/chatroom/${chatroomId}/member/demote`, { 
      userId 
    });
    return response.data;
  }

  async removeMember(chatroomId: string, userId: string) {
    const response = await this.api.delete(`/chatroom/${chatroomId}/member/${userId}`);
    return response.data;
  }

  async validateUsername(username: string) {
    const response = await this.api.get(`/chatroom/validate/username/${username}`);
    return response.data;
  }

  async getMessages(chatroomId: string, limit?: number) {
    const response = await this.api.get(`/messages?chatroomId=${chatroomId}&limit=${limit || 50}`);
    return response.data;
  }

  async getUserChatrooms() {
    const response = await this.api.get('/messages/chatrooms');
    return response.data;
  }

  async markActive(chatroomId: string) {
    const response = await this.api.post('/messages/active', { chatroomId });
    return response.data;
  }

  async markInactive(chatroomId: string) {
    const response = await this.api.post('/messages/inactive', { chatroomId });
    return response.data;
  }
}

export const apiService = new ApiService();