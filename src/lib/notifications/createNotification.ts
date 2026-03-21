export async function createNotification(params: {
  admin: any;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const payload = {
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body || null,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
  };

  const { error } = await params.admin.from("notifications").insert(payload);
  if (error) {
    console.error("createNotification error", error);
  }
}
