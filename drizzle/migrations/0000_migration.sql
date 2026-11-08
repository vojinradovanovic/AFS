CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  line text NOT NULL DEFAULT 'Line 1',
  brand text NOT NULL DEFAULT 'Allen-Bradley',
  protocol text NOT NULL DEFAULT 'OPC UA',
  criticality int NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'running',
  nominal_speed numeric NOT NULL DEFAULT 100,
  run_hours numeric NOT NULL DEFAULT 0,
  hours_since_pm numeric NOT NULL DEFAULT 0,
  pm_interval_hours numeric NOT NULL DEFAULT 500,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own machines" ON public.machines FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.paper_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  record_type text NOT NULL,
  line text NOT NULL DEFAULT 'Line 1',
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  flagged boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  recorded_by text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_records TO authenticated;
GRANT ALL ON public.paper_records TO service_role;
ALTER TABLE public.paper_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own records" ON public.paper_records FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.maintenance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'pm_window',
  title text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  protected boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_events TO authenticated;
GRANT ALL ON public.maintenance_events TO service_role;
ALTER TABLE public.maintenance_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events" ON public.maintenance_events FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.seed_sample_plant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m1 uuid; m2 uuid; m3 uuid; m4 uuid; m5 uuid; m6 uuid;
BEGIN
  INSERT INTO machines(owner_id,name,line,brand,protocol,criticality,status,nominal_speed,run_hours,hours_since_pm,pm_interval_hours,notes)
  VALUES (NEW.id,'Flow Wrapper FW-200','Line 1','Allen-Bradley','EtherNet/IP',5,'running',120,18420,465,500,'Bottleneck on Line 1. Jaw heater replaced in March.') RETURNING id INTO m1;
  INSERT INTO machines(owner_id,name,line,brand,protocol,criticality,status,nominal_speed,run_hours,hours_since_pm,pm_interval_hours,notes)
  VALUES (NEW.id,'Douglas Case Packer CP-4','Line 1','Siemens','OPC UA',4,'running',30,12210,210,600,'Glue system checked weekly.') RETURNING id INTO m2;
  INSERT INTO machines(owner_id,name,line,brand,protocol,criticality,status,nominal_speed,run_hours,hours_since_pm,pm_interval_hours,notes)
  VALUES (NEW.id,'Checkweigher CW-1','Line 2','Mettler Toledo','OPC UA',4,'running',150,9800,90,400,'Target 340 g, tolerance ±5 g.') RETURNING id INTO m3;
  INSERT INTO machines(owner_id,name,line,brand,protocol,criticality,status,nominal_speed,run_hours,hours_since_pm,pm_interval_hours,notes)
  VALUES (NEW.id,'Herma Labeler HL-500','Line 2','Omron','Modbus TCP',3,'idle',140,7600,380,400,'Changeover to retailer B labels pending.') RETURNING id INTO m4;
  INSERT INTO machines(owner_id,name,line,brand,protocol,criticality,status,nominal_speed,run_hours,hours_since_pm,pm_interval_hours,notes)
  VALUES (NEW.id,'Metal Detector MD-3','Line 3','Mitsubishi','CC-Link',5,'running',150,15400,120,700,'Ferrous 1.5 mm test piece.') RETURNING id INTO m5;
  INSERT INTO machines(owner_id,name,line,brand,protocol,criticality,status,nominal_speed,run_hours,hours_since_pm,pm_interval_hours,notes)
  VALUES (NEW.id,'Palletizer PZ-2','Line 3','Allen-Bradley','EtherNet/IP',3,'down',8,21050,690,650,'Down: gripper sensor fault since 06:40.') RETURNING id INTO m6;

  INSERT INTO maintenance_events(owner_id,machine_id,kind,title,starts_at,ends_at,protected,notes) VALUES
   (NEW.id,m1,'pm_window','FW-200 jaw & film path PM', date_trunc('day',now())+interval '2 day 6 hour', date_trunc('day',now())+interval '2 day 10 hour', true, 'Protected window'),
   (NEW.id,m6,'repair','PZ-2 gripper sensor replacement', date_trunc('day',now())+interval '1 day 14 hour', date_trunc('day',now())+interval '1 day 17 hour', false, NULL),
   (NEW.id,m4,'pm_window','HL-500 applicator PM', date_trunc('day',now())+interval '4 day 6 hour', date_trunc('day',now())+interval '4 day 8 hour', true, NULL),
   (NEW.id,m6,'failure','PZ-2 unplanned stop: gripper sensor', now()-interval '3 hour', now()-interval '2 hour', false, 'Operator reported repeated faults');

  INSERT INTO paper_records(owner_id,record_type,line,title,data,flags,flagged,source,recorded_by,recorded_at) VALUES
   (NEW.id,'weight_check','Line 2','Hourly weight check 09:00','{"product":"Granola 340 g","target":340,"tolerance":5,"samples":[341,339,342,333,340]}','["Sample 4 (333 g) is below the 335 g minimum"]',true,'manual','M. Petrović',now()-interval '2 hour'),
   (NEW.id,'batch_sheet','Line 1','Batch B-2291 Oat Bar','{"batch":"B-2291","product":"Oat Bar 40 g","mix_temp_c":72,"target_temp_c":70,"tolerance":3,"quantity_kg":850}','[]',false,'manual','J. Ilić',now()-interval '5 hour'),
   (NEW.id,'changeover','Line 2','Changeover to Retailer B labels','{"from":"Retailer A","to":"Retailer B","checklist":{"Line cleared":true,"Labels verified":true,"Date code set":false,"First-off approved":false},"minutes":42}','["Date code not set","First-off not approved"]',true,'manual','S. Jović',now()-interval '1 day'),
   (NEW.id,'downtime','Line 3','Palletizer downtime','{"machine":"Palletizer PZ-2","reason":"Gripper sensor fault","minutes":65}','[]',false,'manual','D. Marković',now()-interval '3 hour');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_seed_plant
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.seed_sample_plant();