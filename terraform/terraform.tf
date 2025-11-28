terraform {
  required_providers {
    dreamhost = {
      source = "adamantal/dreamhost"
      version = "0.3.2"
    }
  }
}

provider "dreamhost" {
    api_key = var.api_key
}

variable "cnames" {}
variable "api_key" {
  sensitive = true
} #"NJTB8N3Y3DNRF6A9"

resource "dreamhost_dns_record" "cnames" {
  for_each = var.cnames

  record = "${each.key}.kcbitcoiners.com"
  type   = "CNAME"
  value  = each.value
}