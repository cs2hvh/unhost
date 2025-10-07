export type UserRole = 'admin' | 'support' | 'user';

export interface User {
    id: string
    email: string
    username: string
    roles: UserRole[]
}