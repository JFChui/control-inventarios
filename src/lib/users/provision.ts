type OperationError = { message: string };

export async function finalizeUserProvisioning(input: {
  userId: string;
  finalizeProfile: () => Promise<{ error: OperationError | null }>;
  deleteUser: (
    userId: string,
  ) => Promise<{ error: OperationError | null }>;
}): Promise<{ error: string | null }> {
  const { error: profileError } = await input.finalizeProfile();
  if (!profileError) {
    return { error: null };
  }

  const { error: deleteError } = await input.deleteUser(input.userId);
  if (deleteError) {
    return {
      error: `${profileError.message} No se pudo revertir el usuario: ${deleteError.message}`,
    };
  }

  return { error: profileError.message };
}
