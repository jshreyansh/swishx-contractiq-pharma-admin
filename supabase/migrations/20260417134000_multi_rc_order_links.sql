-- Support orders that combine pricing from multiple approved rate contracts

CREATE TABLE IF NOT EXISTS order_rate_contract_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  rc_id uuid REFERENCES rate_contracts(id) ON DELETE CASCADE NOT NULL,
  linked_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(order_id, rc_id)
);

ALTER TABLE order_rate_contract_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on order_rate_contract_links"
  ON order_rate_contract_links
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_order_rate_contract_links_order
  ON order_rate_contract_links(order_id);

CREATE INDEX IF NOT EXISTS idx_order_rate_contract_links_rc
  ON order_rate_contract_links(rc_id);

CREATE OR REPLACE FUNCTION sync_order_rate_contract_links_for_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM order_rate_contract_links
  WHERE order_id = p_order_id;

  INSERT INTO order_rate_contract_links (order_id, rc_id, linked_at)
  SELECT
    p_order_id,
    source.rc_id,
    MIN(source.linked_at) AS linked_at
  FROM (
    SELECT
      o.rc_id,
      COALESCE(o.updated_at, o.created_at, now()) AS linked_at
    FROM orders o
    WHERE o.id = p_order_id
      AND o.rc_id IS NOT NULL

    UNION ALL

    SELECT
      rci.rc_id,
      COALESCE(oi.updated_at, oi.created_at, now()) AS linked_at
    FROM order_items oi
    JOIN rate_contract_items rci
      ON rci.id = oi.rc_item_id
    WHERE oi.order_id = p_order_id
      AND oi.rc_item_id IS NOT NULL
  ) AS source
  WHERE source.rc_id IS NOT NULL
  GROUP BY source.rc_id;
END;
$$;

CREATE OR REPLACE FUNCTION sync_order_rate_contract_links_from_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM sync_order_rate_contract_links_for_order(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_order_rate_contract_links_from_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id uuid;
BEGIN
  target_order_id := COALESCE(NEW.order_id, OLD.order_id);
  PERFORM sync_order_rate_contract_links_for_order(target_order_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_rate_contract_links_from_orders ON orders;
CREATE TRIGGER trg_sync_order_rate_contract_links_from_orders
AFTER INSERT OR UPDATE OF rc_id ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_order_rate_contract_links_from_orders();

DROP TRIGGER IF EXISTS trg_sync_order_rate_contract_links_from_items ON order_items;
CREATE TRIGGER trg_sync_order_rate_contract_links_from_items
AFTER INSERT OR UPDATE OF rc_item_id, order_id OR DELETE ON order_items
FOR EACH ROW
EXECUTE FUNCTION sync_order_rate_contract_links_from_items();

DO $$
DECLARE
  existing_order RECORD;
BEGIN
  FOR existing_order IN SELECT id FROM orders LOOP
    PERFORM sync_order_rate_contract_links_for_order(existing_order.id);
  END LOOP;
END $$;
