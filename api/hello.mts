import type { Config, Context } from "@netlify/functions"

export default async (_req: Request, context: Context) => {
    const name = context.params['name'] ?? 'World';
    return new Response(`Hello, ${name}!`)
}

export const config: Config = {
  path: "/api/hello/:name?"
};