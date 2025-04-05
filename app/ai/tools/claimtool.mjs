import { tool } from "@langchain/core/tools";
import { z } from "zod";

export function setupTools(fastify) {
  const updateClaimStatusTool = tool(
    async function ({ claimId, claimStatus }) {
      console.log('updating claim status', claimStatus);

      const result = await fastify.sqlite.run('update claim set status = ? where id = ?', [claimStatus, claimId]);
      return `Claim Status updated to ${claimStatus} for claimId ${claimId}`;
    }, {
      name: 'updateClaimStatus',
      schema: z.object({
        claimId: z.string().describe('The ID of the claim'),
        claimStatus: z.string().describe('The status of the claim')
      }),
      description: 'Update the claim status'
    }
  );

  return updateClaimStatusTool
}