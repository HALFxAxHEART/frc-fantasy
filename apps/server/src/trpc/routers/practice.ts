import { createPracticeDraftSchema } from "@frc-fantasy/shared";
import { createPracticeDraft } from "../../services/practice";
import { protectedProcedure, router } from "../trpc";

export const practiceRouter = router({
  create: protectedProcedure
    .input(createPracticeDraftSchema)
    .mutation(({ input, ctx }) => createPracticeDraft(input, ctx.user.id, ctx.user.email)),
});
