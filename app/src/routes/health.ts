import type { FastifyPluginAsync } from "fastify";

const health: FastifyPluginAsync = async (fastify): Promise<void> => {
	fastify.get(
		"/health",
		{
			schema: {
				description: "Check the health status of the API",
				tags: ["health"],
				summary: "Health check endpoint",
				response: {
					200: {
						description: "Successful response indicating the API is healthy",
						type: "object",
						properties: {
							status: {
								type: "string",
								enum: ["healthy"],
								description: "Health status indicator",
								example: "healthy",
							},
						},
						required: ["status"],
					},
				},
			},
		},
		async (_request, reply) => {
			return reply.code(200).send({ status: "healthy" });
		},
	);
};

export default health;
