import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "https://cvrqblizwcxeoftfjxvg.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnFibGl6d2N4ZW9mdGZqeHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NjA1MzAsImV4cCI6MjA3ODMzNjUzMH0.7c0SH1fk0qTY-iHhfqBdW5yZZ4g9L3n9cy_EWtW4Bxw"
);
