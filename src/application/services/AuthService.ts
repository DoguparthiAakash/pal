import { createClient } from '@/infrastructure/auth/server';
import { User, KnowledgeBase } from '@/domain/entities';
import { SupabaseUserRepository } from '@/infrastructure/repositories/SupabaseUserRepository';
import { SupabaseKnowledgeBaseRepository } from '@/infrastructure/repositories/SupabaseKnowledgeBaseRepository';

export class AuthService {
  private userRepo: SupabaseUserRepository;
  private kbRepo: SupabaseKnowledgeBaseRepository;

  constructor() {
    this.userRepo = new SupabaseUserRepository();
    this.kbRepo = new SupabaseKnowledgeBaseRepository();
  }

  async getCurrentUser(): Promise<User | null> {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return await this.userRepo.findById(user.id);
  }

  async getDefaultKnowledgeBase(userId: string): Promise<KnowledgeBase | null> {
    const kbs = await this.kbRepo.findByUserId(userId);
    return kbs.find(kb => kb.is_default) || kbs[0] || null;
  }
}

export class AuthorizationService {
  /**
   * Verifies that the given resource belongs to the current user.
   * This acts as an application-level guard rail on top of database RLS.
   */
  async verifyOwnership(ownerId: string, currentUserId: string): Promise<boolean> {
    return ownerId === currentUserId;
  }
}
