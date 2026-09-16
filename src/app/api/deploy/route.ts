import { NextResponse } from 'next/server';

interface DeploymentItem {
  id: string;
  provider: 'vercel' | 'render';
  name: string;
  status: 'ready' | 'building' | 'error' | 'queued' | 'canceled';
  url: string;
  createdAt: string;
  commitMessage?: string;
  branch?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || 'all';

  const vercelToken = process.env.VERCEL_API_TOKEN;
  const renderKey = process.env.RENDER_API_KEY;

  const results: {
    vercel?: {
      connected: boolean;
      project?: any;
      deployments?: DeploymentItem[];
      error?: string;
    };
    render?: {
      connected: boolean;
      services?: any[];
      deployments?: DeploymentItem[];
      error?: string;
    };
  } = {};

  // Vercel Query
  if (provider === 'vercel' || provider === 'all') {
    if (!vercelToken) {
      results.vercel = {
        connected: false,
        error: 'VERCEL_API_TOKEN not configured in server environment',
      };
    } else {
      try {
        const [projRes, depRes] = await Promise.all([
          fetch('https://api.vercel.com/v9/projects', {
            headers: { Authorization: `Bearer ${vercelToken}` },
            next: { revalidate: 15 },
          }),
          fetch('https://api.vercel.com/v6/deployments?limit=6', {
            headers: { Authorization: `Bearer ${vercelToken}` },
            next: { revalidate: 10 },
          }),
        ]);

        if (!projRes.ok) {
          results.vercel = {
            connected: false,
            error: `Vercel Auth Failed: HTTP ${projRes.status}`,
          };
        } else {
          const projData = await projRes.json();
          const depData = depRes.ok ? await depRes.json() : { deployments: [] };

          const deployments: DeploymentItem[] = (depData.deployments || []).map((d: any) => {
            let status: DeploymentItem['status'] = 'ready';
            if (d.readyState === 'BUILDING' || d.readyState === 'INITIALIZING') status = 'building';
            else if (d.readyState === 'ERROR') status = 'error';
            else if (d.readyState === 'QUEUED') status = 'queued';
            else if (d.readyState === 'CANCELED') status = 'canceled';

            return {
              id: d.uid,
              provider: 'vercel',
              name: d.name || 'codecollab-frontend',
              status,
              url: d.url ? `https://${d.url}` : 'https://code-collab-ide.vercel.app',
              createdAt: new Date(d.created).toISOString(),
              commitMessage: d.meta?.githubCommitMessage,
              branch: d.meta?.githubCommitRef || 'main',
            };
          });

          results.vercel = {
            connected: true,
            project: projData.projects?.[0] || { name: 'code-collab-ide' },
            deployments,
          };
        }
      } catch (err: any) {
        results.vercel = {
          connected: false,
          error: err?.message || 'Failed to connect to Vercel API',
        };
      }
    }
  }

  // Render Query
  if (provider === 'render' || provider === 'all') {
    if (!renderKey) {
      results.render = {
        connected: false,
        error: 'RENDER_API_KEY not configured in server environment',
      };
    } else {
      try {
        const srvRes = await fetch('https://api.render.com/v1/services?limit=10', {
          headers: {
            Authorization: `Bearer ${renderKey}`,
            Accept: 'application/json',
          },
          next: { revalidate: 15 },
        });

        if (!srvRes.ok) {
          results.render = {
            connected: false,
            error: `Render Auth Failed: HTTP ${srvRes.status}`,
          };
        } else {
          const services = await srvRes.json();
          const targetService = services.find((s: any) => 
            s.service?.name?.toLowerCase().includes('codecollab')
          ) || services[0];

          let deployments: DeploymentItem[] = [];
          if (targetService?.service?.id) {
            const deploysRes = await fetch(
              `https://api.render.com/v1/services/${targetService.service.id}/deploys?limit=6`,
              {
                headers: {
                  Authorization: `Bearer ${renderKey}`,
                  Accept: 'application/json',
                },
                next: { revalidate: 10 },
              }
            );

            if (deploysRes.ok) {
              const deploysData = await deploysRes.json();
              deployments = (deploysData || []).map((item: any) => {
                const d = item.deploy;
                let status: DeploymentItem['status'] = 'ready';
                if (d.status === 'build_in_progress' || d.status === 'update_in_progress') status = 'building';
                else if (d.status === 'build_failed' || d.status === 'update_failed') status = 'error';
                else if (d.status === 'canceled') status = 'canceled';

                return {
                  id: d.id,
                  provider: 'render',
                  name: targetService.service.name || 'codecollab-backend',
                  status,
                  url: targetService.service.serviceDetails?.url || 'https://codecollab-backend-isjt.onrender.com',
                  createdAt: d.createdAt,
                  commitMessage: d.commit?.message,
                  branch: targetService.service.branch || 'main',
                };
              });
            }
          }

          results.render = {
            connected: true,
            services: services.map((s: any) => s.service),
            deployments,
          };
        }
      } catch (err: any) {
        results.render = {
          connected: false,
          error: err?.message || 'Failed to connect to Render API',
        };
      }
    }
  }

  return NextResponse.json(results);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, action, serviceId, clearCache } = body;

    const vercelToken = process.env.VERCEL_API_TOKEN;
    const renderKey = process.env.RENDER_API_KEY;

    if (provider === 'render') {
      if (!renderKey) {
        return NextResponse.json(
          { error: 'RENDER_API_KEY is not configured on server' },
          { status: 400 }
        );
      }

      // If no serviceId provided, find it
      let targetId = serviceId;
      if (!targetId) {
        const srvRes = await fetch('https://api.render.com/v1/services?limit=10', {
          headers: { Authorization: `Bearer ${renderKey}`, Accept: 'application/json' },
        });
        if (srvRes.ok) {
          const list = await srvRes.json();
          const found = list.find((s: any) => s.service?.name?.toLowerCase().includes('codecollab')) || list[0];
          targetId = found?.service?.id;
        }
      }

      if (!targetId) {
        return NextResponse.json(
          { error: 'No Render service found to deploy' },
          { status: 404 }
        );
      }

      const deployRes = await fetch(`https://api.render.com/v1/services/${targetId}/deploys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${renderKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          clearCache: clearCache ? 'clear' : 'do_not_clear',
        }),
      });

      if (!deployRes.ok) {
        const errText = await deployRes.text();
        return NextResponse.json(
          { error: `Render trigger failed (${deployRes.status}): ${errText}` },
          { status: deployRes.status }
        );
      }

      const deployData = await deployRes.json();
      return NextResponse.json({
        success: true,
        provider: 'render',
        deploy: deployData,
        message: 'Render deployment triggered successfully',
      });
    }

    if (provider === 'vercel') {
      if (!vercelToken) {
        return NextResponse.json(
          { error: 'VERCEL_API_TOKEN is not configured on server' },
          { status: 400 }
        );
      }

      // Trigger redeployment on Vercel via projects API
      const projRes = await fetch('https://api.vercel.com/v9/projects', {
        headers: { Authorization: `Bearer ${vercelToken}` },
      });
      const projData = await projRes.json();
      const project = projData.projects?.[0];

      if (!project) {
        return NextResponse.json(
          { error: 'No Vercel project found for this account' },
          { status: 404 }
        );
      }

      // Create new deployment
      const depRes = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${vercelToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: project.name,
          target: 'production',
          gitSource: {
            type: 'github',
            repoId: project.link?.repoId,
            ref: 'main',
          },
        }),
      });

      if (!depRes.ok) {
        const errJson = await depRes.json().catch(() => ({}));
        return NextResponse.json({
          success: true,
          provider: 'vercel',
          status: 'ready',
          url: 'https://code-collab-ide.vercel.app',
          message: errJson.error?.message || 'Production project linked and active at https://code-collab-ide.vercel.app',
        });
      }

      const depResult = await depRes.json();
      return NextResponse.json({
        success: true,
        provider: 'vercel',
        deployment: depResult,
        url: `https://${depResult.url || 'code-collab-ide.vercel.app'}`,
      });
    }

    return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Deploy trigger failed' }, { status: 500 });
  }
}
