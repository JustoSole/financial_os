CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    hotel_web TEXT,
    uses_cloudbeds BOOLEAN,
    room_count TEXT,
    priority TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert (public lead capture)
CREATE POLICY "Allow public insert to leads" ON public.leads
    FOR INSERT WITH CHECK (true);

-- Create policy to allow only authenticated users to view leads (for admin/internal use)
CREATE POLICY "Allow authenticated select to leads" ON public.leads
    FOR SELECT USING (auth.role() = 'authenticated');
;
