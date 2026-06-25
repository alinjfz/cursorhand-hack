import "../src/lib/env.js";
import { getAllLeads, getLeadStats } from "../src/lib/supabase.js";

const leads = await getAllLeads();
const stats = await getLeadStats();
console.log(`✓ ${leads.length} leads in Supabase`);
console.log(JSON.stringify(stats, null, 2));
