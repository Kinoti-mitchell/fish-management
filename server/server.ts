// server.ts - Fish Management API (Supabase-powered)
import { Hono } from "https://deno.land/x/hono@v4.3.11/mod.ts";
import { cors } from "https://deno.land/x/hono@v4.3.11/middleware.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";
import { z } from "https://esm.sh/zod@3.22.4";
import { fromFileUrl } from "https://deno.land/std@0.208.0/path/mod.ts";

// Load env vars relative to this file so it works from any CWD
const envPath = fromFileUrl(new URL("./server.env", import.meta.url));
await load({ envPath, export: true });

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY in server.env");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const app = new Hono();

// -----------------------------------------------------------------------------
// Middlewares
// -----------------------------------------------------------------------------
app.use("*", async (c, next) => {
  console.log(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url}`);
  await next();
});

app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001", "https://kinoti-mitchell.github.io"], // restrict in prod
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Serve static files with correct MIME types
app.use("/*", async (c, next) => {
  const url = new URL(c.req.url);
  
  // Handle JavaScript modules
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs')) {
    try {
      const filePath = `./build${url.pathname}`;
      const file = await Deno.readFile(filePath);
      
      c.header('Content-Type', 'application/javascript; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=31536000');
      return c.body(file);
    } catch (error) {
      // File not found, continue to next middleware
    }
  }
  
  // Handle CSS files
  if (url.pathname.endsWith('.css')) {
    try {
      const filePath = `./build${url.pathname}`;
      const file = await Deno.readFile(filePath);
      
      c.header('Content-Type', 'text/css; charset=utf-8');
      c.header('Cache-Control', 'public, max-age=31536000');
      return c.body(file);
    } catch (error) {
      // File not found, continue to next middleware
    }
  }
  
  // Handle HTML files
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    try {
      const filePath = url.pathname === '/' ? './build/index.html' : `./build${url.pathname}`;
      const file = await Deno.readFile(filePath);
      
      c.header('Content-Type', 'text/html; charset=utf-8');
      return c.body(file);
    } catch (error) {
      // File not found, continue to next middleware
    }
  }
  
  await next();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const paginate = (c: any) => {
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 20);
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  return { from, to, page, limit };
};

const handleError = (c: any, error: any) => {
  console.error("❌ API Error:", error);
  return c.json(
    { status: "error", message: error?.message || "Unexpected error" },
    500,
  );
};

// -----------------------------------------------------------------------------
// Validation Schemas
// -----------------------------------------------------------------------------
const fishSchema = z.object({
  name: z.string(),
  species: z.string(),
  weight: z.number().positive(),
  price_per_kg: z.number().nonnegative(),
  stock_quantity: z.number().int().nonnegative(),
  location: z.string().optional(),
});

const orderSchema = z.object({
  customer_name: z.string(),
  customer_email: z.string().email().optional(),
  customer_phone: z.string().optional(),
  total_amount: z.number().nonnegative(),
  status: z.enum(["pending", "confirmed", "processing", "completed", "cancelled"]),
  order_date: z.string(),
  order_items: z.array(
    z.object({
      fish_id: z.string(),
      quantity: z.number().int().positive(),
      unit_price: z.number().nonnegative(),
      subtotal: z.number().nonnegative(),
    }),
  ),
});

// -----------------------------------------------------------------------------
// Health Check
// -----------------------------------------------------------------------------
app.get("/health", async (c) => {
  try {
    const { error } = await supabase.from("fish").select("id").limit(1);
    return c.json({
      status: error ? "degraded" : "ok",
      supabase: error ? "unreachable" : "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(c, error);
  }
});

// -----------------------------------------------------------------------------
// Fish Endpoints
// -----------------------------------------------------------------------------
app.get("/api/fish", async (c) => {
  try {
    const { from, to } = paginate(c);
    const { data, error } = await supabase
      .from("fish")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return c.json({ status: "success", data, count: data?.length || 0 });
  } catch (error) {
    return handleError(c, error);
  }
});

app.get("/api/fish/:id", async (c) => {
  try {
    const { data, error } = await supabase
      .from("fish")
      .select("*")
      .eq("id", c.req.param("id"))
      .single();

    if (error) throw error;
    return c.json({ status: "success", data });
  } catch (error) {
    return handleError(c, error);
  }
});

app.post("/api/fish", async (c) => {
  try {
    const parsed = fishSchema.parse(await c.req.json());
    const { data, error } = await supabase.from("fish").insert([parsed]).select().single();
    if (error) throw error;
    return c.json({ status: "success", data, message: "Fish created successfully" }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.put("/api/fish/:id", async (c) => {
  try {
    const parsed = fishSchema.partial().parse(await c.req.json());
    const { data, error } = await supabase
      .from("fish")
      .update(parsed)
      .eq("id", c.req.param("id"))
      .select()
      .single();

    if (error) throw error;
    return c.json({ status: "success", data, message: "Fish updated successfully" });
  } catch (error) {
    return handleError(c, error);
  }
});

app.delete("/api/fish/:id", async (c) => {
  try {
    const { error } = await supabase.from("fish").delete().eq("id", c.req.param("id"));
    if (error) throw error;
    return c.json({ status: "success", message: "Fish deleted successfully" });
  } catch (error) {
    return handleError(c, error);
  }
});

// -----------------------------------------------------------------------------
// Orders Endpoints
// -----------------------------------------------------------------------------
app.get("/api/orders", async (c) => {
  try {
    const { from, to } = paginate(c);
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        order_items (
          *,
          fish:fish_id (name, species)
        )
      `,
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return c.json({ status: "success", data, count: data?.length || 0 });
  } catch (error) {
    return handleError(c, error);
  }
});

app.post("/api/orders", async (c) => {
  try {
    const parsed = orderSchema.parse(await c.req.json());
    const { order_items, ...orderInfo } = parsed;

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert([orderInfo])
      .select()
      .single();
    if (orderError) throw orderError;

    // Insert items
    const itemsWithOrderId = order_items.map((i) => ({ ...i, order_id: order.id }));
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsWithOrderId)
      .select(`*, fish:fish_id (name, species)`);

    if (itemsError) throw itemsError;

    return c.json(
      { status: "success", data: { ...order, order_items: items }, message: "Order created" },
      201,
    );
  } catch (error) {
    return handleError(c, error);
  }
});

// -----------------------------------------------------------------------------
// User Management Endpoints
// -----------------------------------------------------------------------------
app.post("/user-management", async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate required fields
    if (!body.email || !body.password || !body.first_name || !body.last_name || !body.role) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return c.json({ error: 'Invalid email format' }, 400);
    }

    // Get the service role key from environment
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceRoleKey) {
      return c.json({ error: 'Service role key not configured' }, 500);
    }

    // Create Supabase client with service role key
    const adminSupabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: body.email.toLowerCase().trim(),
      password: body.password,
      email_confirm: true,
      user_metadata: {
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        role: body.role,
        phone: body.phone?.trim() || null,
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return c.json({ 
        error: authError.message.includes('email') 
          ? 'A user with this email address already exists' 
          : 'Failed to create user: ' + authError.message 
      }, 400);
    }

    // Create profile in profiles table
    const { error: profileError } = await adminSupabase
      .from('profiles')
      .insert([{
        id: authData.user.id,
        email: body.email.toLowerCase().trim(),
        first_name: body.first_name.trim(),
        last_name: body.last_name.trim(),
        role: body.role,
        phone: body.phone?.trim() || null,
        is_active: true,
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

    if (profileError) {
      console.error('Profile error:', profileError);
      // Try to clean up the auth user if profile creation fails
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      
      return c.json({ 
        error: 'Failed to create user profile: ' + profileError.message 
      }, 500);
    }

    return c.json({ 
      success: true, 
      user: {
        id: authData.user.id,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        role: body.role,
        phone: body.phone
      }
    }, 200);

  } catch (error) {
    console.error('User creation error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// -----------------------------------------------------------------------------
// Dashboard Analytics
// -----------------------------------------------------------------------------
app.get("/api/dashboard/stats", async (c) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { count: fishCount } = await supabase.from("fish").select("*", { count: "exact", head: true });
    const { count: ordersCount } = await supabase.from("orders").select("*", { count: "exact", head: true });
    const { count: pendingDeliveries } = await supabase
      .from("deliveries")
      .select("*", { count: "exact", head: true })
      .in("status", ["scheduled", "in_transit"]);
    const { data: todayOrders } = await supabase
      .from("orders")
      .select("total_amount")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    const todayRevenue = todayOrders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;

    return c.json({
      status: "success",
      data: {
        fishCount: fishCount || 0,
        ordersCount: ordersCount || 0,
        pendingDeliveries: pendingDeliveries || 0,
        todayRevenue,
      },
    });
  } catch (error) {
    return handleError(c, error);
  }
});

// -----------------------------------------------------------------------------
// 404 + Error Handlers
// -----------------------------------------------------------------------------
app.notFound((c) => c.json({ status: "error", message: "Route not found" }, 404));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ status: "error", message: "Internal server error" }, 500);
});

// -----------------------------------------------------------------------------
// Start Server
// -----------------------------------------------------------------------------
console.log("🚀 Fish Management API running on http://localhost:8000");
console.log("🐟 Fish API: http://localhost:8000/api/fish");
console.log("📋 Orders API: http://localhost:8000/api/orders");
console.log("👥 User Management: http://localhost:8000/user-management");
console.log("📊 Dashboard: http://localhost:8000/api/dashboard/stats");
console.log("❤️ Health: http://localhost:8000/health");

Deno.serve(app.fetch);
