import { NextRequest } from "next/server";
import { LinodeAPIClient, LINODE_REGIONS, LINODE_IMAGES, LINODE_PLAN_TYPES, LINODE_PLAN_CATEGORIES, getPlansByCategory, getFlagUrl } from "@/lib/linode";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const linodeToken = process.env.LINODE_API_TOKEN;

  if (!linodeToken) {
    return Response.json(
      { ok: false, error: "LINODE_API_TOKEN not configured" },
      { status: 500 }
    );
  }

  try {
    const client = new LinodeAPIClient({
      api_token: linodeToken,
      region: "us-east",
    });

    // Fetch available regions and images from Linode API
    const [regions, images] = await Promise.all([
      client.getRegions(),
      client.getImages(),
    ]);

    // Format regions with country info
    const formattedRegions = Object.entries(LINODE_REGIONS).map(([id, regionInfo]) => ({
      id,
      name: regionInfo.country,
      label: `${regionInfo.country} - ${regionInfo.city}`,
      countryCode: regionInfo.countryCode,
      flagUrl: getFlagUrl(regionInfo.countryCode, 64),
      country: regionInfo.country,
      city: regionInfo.city,
      available: regions.some(r => r.id === id)
    }));

    // Format images (filter to common OS) and group by category
    const formattedImages = Object.entries(LINODE_IMAGES).map(([id, osInfo]) => ({
      id,
      name: osInfo.name,
      label: osInfo.name,
      category: osInfo.category,
      logo: osInfo.logo,
      available: images.some(img => img.id === id)
    }));

    // Group images by category
    const groupedImages: Record<string, typeof formattedImages> = {};
    formattedImages.forEach(img => {
      if (!groupedImages[img.category]) {
        groupedImages[img.category] = [];
      }
      groupedImages[img.category].push(img);
    });

    // Format plan categories
    const planCategories = Object.entries(LINODE_PLAN_CATEGORIES).map(([id, label]) => ({
      id,
      label
    }));

    // Format plans by category
    const plansByCategory = getPlansByCategory();
    const formattedPlans = Object.entries(LINODE_PLAN_TYPES).map(([id, specs]) => ({
      id,
      category: specs.category,
      label: specs.label,
      vcpus: specs.vcpus,
      memory: specs.memory,
      disk: specs.disk,
      transfer: specs.transfer,
      hourly: specs.hourly,
      monthly: specs.monthly,
    }));

    return Response.json({
      ok: true,
      regions: formattedRegions,
      images: formattedImages,
      groupedImages,
      planCategories,
      plans: formattedPlans,
      plansByCategory,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Failed to fetch Linode options" },
      { status: 500 }
    );
  }
}
