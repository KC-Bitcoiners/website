terraform {
  required_providers {
    dreamhost = {
      source = "adamantal/dreamhost"
      version = "0.3.2"
    }
  }
}

provider "dreamhost" {
    api_key = "NJTB8N3Y3DNRF6A9"
}

variable "cnames" {}

resource "dreamhost_dns_record" "cnames" {
  for_each = var.cnames

  record = "${each.key}.kcbitcoiners.com"
  type   = "CNAME"
  value  = each.value
}