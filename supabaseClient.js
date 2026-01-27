// supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://lanxxvocjwpyegoxxxkj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxhbnh4dm9jandweWVnb3h4eGtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjM5NTUsImV4cCI6MjA4NTA5OTk1NX0.8cLx5E-PJCybIYjcPPInqUA2z0Q31bY_rXvazB4aLhU';
export const supabase = createClient(supabaseUrl, supabaseKey);

// supabase menuiserie