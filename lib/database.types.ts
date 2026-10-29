
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "activities": {
                  Row: {
                    "body": string | null,"completed_at": string | null,"contact_id": string | null,"created_at": string,"deal_id": string | null,"due_at": string | null,"id": string,"kind": string,"org_id": string,"owner_id": string | null,"subject": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"completed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"deal_id"?: string | null,"due_at"?: string | null,"id"?: string,"kind": string,"org_id": string,"owner_id"?: string | null,"subject": string
                  }
                  Update: {
                    "body"?: string | null,"completed_at"?: string | null,"contact_id"?: string | null,"created_at"?: string,"deal_id"?: string | null,"due_at"?: string | null,"id"?: string,"kind"?: string,"org_id"?: string,"owner_id"?: string | null,"subject"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_contact_id_org_id_fkey"
      columns: ["contact_id","org_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "activities_deal_id_org_id_fkey"
      columns: ["deal_id","org_id"]
isOneToOne: false
      referencedRelation: "deals"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "activities_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage": {
                  Row: {
                    "created_at": string,"feature": string,"id": number,"input_tokens": number | null,"org_id": string,"output_tokens": number | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"feature": string,"id"?: never,"input_tokens"?: number | null,"org_id": string,"output_tokens"?: number | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"feature"?: string,"id"?: never,"input_tokens"?: number | null,"org_id"?: string,"output_tokens"?: number | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": NonNullable<Json>,"created_at": string,"entity": string,"entity_id": string | null,"id": number,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity": string,"entity_id"?: string | null,"id"?: never,"org_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"created_at"?: string,"entity"?: string,"entity_id"?: string | null,"id"?: never,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "audit_log_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_orders": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"id": string,"months": number,"org_id": string,"paid_at": string | null,"plan": string,"provider_payload": Json | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"id": string,"months": number,"org_id": string,"paid_at"?: string | null,"plan": string,"provider_payload"?: Json | null,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"id"?: string,"months"?: number,"org_id"?: string,"paid_at"?: string | null,"plan"?: string,"provider_payload"?: Json | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "billing_orders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "billing_orders_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"companies": {
                  Row: {
                    "created_at": string,"created_by": string | null,"domain": string | null,"id": string,"industry": string | null,"name": string,"org_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"domain"?: string | null,"id"?: string,"industry"?: string | null,"name": string,"org_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"domain"?: string | null,"id"?: string,"industry"?: string | null,"name"?: string,"org_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "companies_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "companies_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"contacts": {
                  Row: {
                    "ai_score": number | null,"ai_score_reasons": Json | null,"ai_summary": string | null,"ai_updated_at": string | null,"company_id": string | null,"created_at": string,"email": string | null,"full_name": string,"id": string,"notes": string | null,"org_id": string,"owner_id": string | null,"phone": string | null,"source": string,"status": string,"title": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_score"?: number | null,"ai_score_reasons"?: Json | null,"ai_summary"?: string | null,"ai_updated_at"?: string | null,"company_id"?: string | null,"created_at"?: string,"email"?: string | null,"full_name": string,"id"?: string,"notes"?: string | null,"org_id": string,"owner_id"?: string | null,"phone"?: string | null,"source"?: string,"status"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_score"?: number | null,"ai_score_reasons"?: Json | null,"ai_summary"?: string | null,"ai_updated_at"?: string | null,"company_id"?: string | null,"created_at"?: string,"email"?: string | null,"full_name"?: string,"id"?: string,"notes"?: string | null,"org_id"?: string,"owner_id"?: string | null,"phone"?: string | null,"source"?: string,"status"?: string,"title"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contacts_company_id_org_id_fkey"
      columns: ["company_id","org_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "contacts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contacts_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"deals": {
                  Row: {
                    "closed_at": string | null,"company_id": string | null,"contact_id": string | null,"created_at": string,"expected_close": string | null,"id": string,"org_id": string,"owner_id": string | null,"position": number,"stage_id": string,"title": string,"updated_at": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"company_id"?: string | null,"contact_id"?: string | null,"created_at"?: string,"expected_close"?: string | null,"id"?: string,"org_id": string,"owner_id"?: string | null,"position"?: number,"stage_id": string,"title": string,"updated_at"?: string,"value"?: number
                  }
                  Update: {
                    "closed_at"?: string | null,"company_id"?: string | null,"contact_id"?: string | null,"created_at"?: string,"expected_close"?: string | null,"id"?: string,"org_id"?: string,"owner_id"?: string | null,"position"?: number,"stage_id"?: string,"title"?: string,"updated_at"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "deals_company_id_org_id_fkey"
      columns: ["company_id","org_id"]
isOneToOne: false
      referencedRelation: "companies"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "deals_contact_id_org_id_fkey"
      columns: ["contact_id","org_id"]
isOneToOne: false
      referencedRelation: "contacts"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "deals_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deals_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "deals_stage_id_org_id_fkey"
      columns: ["stage_id","org_id"]
isOneToOne: false
      referencedRelation: "pipeline_stages"
      referencedColumns: ["id","org_id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"expires_at": string,"id": string,"invited_by": string | null,"org_id": string,"role": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_id": string,"role": string,"token"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"expires_at"?: string,"id"?: string,"invited_by"?: string | null,"org_id"?: string,"role"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"org_id": string,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"role": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"is_demo": boolean,"name": string,"plan": string,"plan_expires_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_demo"?: boolean,"name": string,"plan"?: string,"plan_expires_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_demo"?: boolean,"name"?: string,"plan"?: string,"plan_expires_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"pipeline_stages": {
                  Row: {
                    "id": string,"kind": string,"name": string,"org_id": string,"position": number,"probability": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"kind"?: string,"name": string,"org_id": string,"position": number,"probability"?: number
                  }
                  Update: {
                    "id"?: string,"kind"?: string,"name"?: string,"org_id"?: string,"position"?: number,"probability"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pipeline_stages_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string,"full_name": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email": string,"full_name"?: string | null,"id": string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"full_name"?: string | null,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"apply_billing_notification":
{ Args: { "p_amount": number,"p_order": string,"p_payload": Json,"p_status": string }; Returns: undefined
                           },
"consume_ai_quota":
{ Args: { "p_feature": string,"p_org": string }; Returns: Record<string, unknown>
                           },
"create_billing_order":
{ Args: { "p_months": number,"p_org": string }; Returns: {
              "amount": number,
"created_at": string,
"created_by": string | null,
"id": string,
"months": number,
"org_id": string,
"paid_at": string | null,
"plan": string,
"provider_payload": Json | null,
"status": string
            }
                          SetofOptions: {
        from: "*"
        to: "billing_orders"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_organization":
{ Args: { "p_name": string }; Returns: string
                           },
"import_contacts":
{ Args: { "p_org": string,"p_rows": Json,"p_source"?: string }; Returns: Json
                           },
"org_metrics":
{ Args: { "p_org": string }; Returns: Json
                           },
"record_ai_tokens":
{ Args: { "p_input": number,"p_output": number,"p_usage_id": number }; Returns: undefined
                           },
"remove_member":
{ Args: { "p_org": string,"p_user": string }; Returns: undefined
                           },
"reset_demo":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"save_contact_ai":
{ Args: { "p_contact": string,"p_reasons"?: Json,"p_score"?: number,"p_summary"?: string }; Returns: undefined
                           },
"set_member_role":
{ Args: { "p_org": string,"p_role": string,"p_user": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
