#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listCollections, createCollection, dropCollection, cleanup } from "./mongo-tools.js";

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Helper function for making NWS API requests
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NWS request:", error);
    return null;
  }
}
// rest api with bearer token
async function fetchWithBearerToken(url: string, token: string): Promise<any> {
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error making API request:", error);
    return null;
  }
}

interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// Format alert data
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

interface AlertsResponse {
  features: AlertFeature[];
}

interface PointsResponse {
  properties: {
    forecast?: string;
  };
}

interface ForecastResponse {
  properties: {
    periods: ForecastPeriod[];
  };
}

// Create server instance
const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

server.tool(
  "get-current-location",
  "Get current latitude and longitude based on IP address",
  {},
  async () => {
    try {
      // Using ipapi.co for IP-based geolocation
      const response = await fetch("https://ipapi.co/json/", {
        headers: {
          "User-Agent": USER_AGENT,
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        return {
          content: [
            {
              type: "text",
              text: `Current location:\nLatitude: ${data.latitude}\nLongitude: ${data.longitude}\nCity: ${data.city || "Unknown"}\nRegion: ${data.region || "Unknown"}\nCountry: ${data.country_name || "Unknown"}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Unable to determine current location from IP address",
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting current location: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  },
);

// create a mcp tool to fetch a rest get api tool name is get courses
server.tool(
  "get-courses",
  "Get a list of courses",
  {},
  async () => {
    const coursesUrl = process.env.COURSES_API_URL || "https://example.com/api/courses";
    const apiKey = process.env.API_KEY || "";
    const coursesData = await fetchWithBearerToken(coursesUrl, apiKey);
    if (!coursesData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve courses data",
          },
        ],
      };
    }

    try {
      // Handle response format: data -> courseList -> courseTitle
      let courseTitles: string[] = [];
      if (
        coursesData &&
        coursesData.data &&
        Array.isArray(coursesData.data.courseList)
      ) {
        courseTitles = coursesData.data.courseList.map((course: any) => course.courseTitle || JSON.stringify(course));
      }

      if (
        coursesData &&
        coursesData.data &&
        Array.isArray(coursesData.data.courseList) &&
        coursesData.data.courseList.length > 0
      ) {
        return {
          content: [
            {
              type: "text",
              text: `Full course list:\n${JSON.stringify(coursesData.data.courseList, null, 2)}`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Courses data received (raw format):\n${JSON.stringify(coursesData, null, 2)}`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error processing courses data: ${error instanceof Error ? error.message : "Unknown error"}\nRaw data: ${JSON.stringify(coursesData, null, 2)}`,
          },
        ],
      };
    }
  },
);

//create a mcp tool for mongo db operations

// MongoDB Collection Management Tools
server.tool(
  "list-collections",
  "List all collections in the MongoDB database",
  {},
  async () => {
    try {
      const collections = await listCollections();
      return {
        content: [
          {
            type: "text",
            text: collections.length > 0 
              ? `Collections in database:\n${collections.map(name => `- ${name}`).join('\n')}`
              : "No collections found in the database",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error listing collections: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "create-collection",
  "Create a new collection in the MongoDB database",
  {
    collectionName: z.string().describe("Name of the collection to create"),
  },
  async ({ collectionName }) => {
    try {
      const result = await createCollection(collectionName);
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "drop-collection",
  "Drop (delete) a collection from the MongoDB database",
  {
    collectionName: z.string().describe("Name of the collection to drop"),
  },
  async ({ collectionName }) => {
    try {
      const result = await dropCollection(collectionName);
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error dropping collection: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  },
);

server.tool(
  "get-forecast",
  "Get weather forecast for a location",
  {
    latitude: z.number().min(-90).max(90).describe("Latitude of the location"),
    longitude: z
      .number()
      .min(-180)
      .max(180)
      .describe("Longitude of the location"),
  },
  async ({ latitude, longitude }) => {
    // Get grid point data
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported).`,
          },
        ],
      };
    }

    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to get forecast URL from grid point data",
          },
        ],
      };
    }

    // Get forecast data
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);
    if (!forecastData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve forecast data",
          },
        ],
      };
    }

    const periods = forecastData.properties?.periods || [];
    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No forecast periods available",
          },
        ],
      };
    }

    // Format forecast periods
    const formattedForecast = periods.map((period: ForecastPeriod) =>
      [
        `${period.name || "Unknown"}:`,
        `Temperature: ${period.temperature || "Unknown"}°${period.temperatureUnit || "F"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`,
        `${period.shortForecast || "No forecast available"}`,
        "---",
      ].join("\n"),
    );

    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join("\n")}`;

    return {
      content: [
        {
          type: "text",
          text: forecastText,
        },
      ],
    };
  },
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    console.error('Received SIGINT, cleaning up...');
    await cleanup();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, cleaning up...');
    await cleanup();
    process.exit(0);
  });
  
  await server.connect(transport);
  console.error("Weather MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
