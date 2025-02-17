import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function setupTools(fastify) {
  const updateClaimStatusTool = tool(
    async ({ claimId, claimStatus }) => {
      console.log('updating claim status', claimStatus);
      return [`Claim Status updated to ${claimStatus} for claimId ${claimId}`, 'Completed'];
      // fastify.sqlite.run('update claim set status = ? where id = ?', [claimStatus, claimId], (err, rows) => {
      //   console.log('function run', err, rows);
      //   return [`Claim Status updated to ${claimStatus} for claimId ${claimId}`, 'Completed'];
      // });
    }, {
      name: 'update claim status',
      description: 'Updates the status of a claim',
      schema: z.object({
        claimId: z.string(),
        claimStatus: z.string()
      }),
      responseFormat: "content_and_artifact",
    }
  );

  return updateClaimStatusTool
}