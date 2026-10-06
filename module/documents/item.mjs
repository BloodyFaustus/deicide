export class DeicideItem extends foundry.documents.Item {

  static getDefaultArtwork(itemData) {
    const icons = {
      ability: "icons/svg/sword.svg", class: "icons/svg/book.svg", origin: "icons/svg/mystery-man.svg",
      weapon: "icons/svg/sword.svg", armor: "icons/svg/shield.svg", offhand: "icons/svg/shield.svg",
      accessory: "icons/svg/item-bag.svg", pin: "icons/svg/item-bag.svg", consumable: "icons/svg/chest.svg",
      named: "icons/svg/holy-shield.svg"
    };
    return {img: icons[itemData?.type] ?? super.getDefaultArtwork(itemData).img};
  }

  get derived() {
    return this.system.derived ?? {};
  }

  get identifier() {
    return this.system.identifier;
  }

  async toggleEquipped(state) {
    const slot = this.system.slot;
    if ( !slot ) return this;
    const next = state ?? !this.system.equipped;
    const updates = [{_id: this.id, "system.equipped": next}];
    if ( next && this.actor && (slot !== "accessory") ) {
      for ( const other of this.actor.items ) {
        if ( (other.id !== this.id) && (other.system.slot === slot) && other.system.equipped ) {
          updates.push({_id: other.id, "system.equipped": false});
        }
      }
    }
    if ( next && this.actor && (slot === "accessory") ) {
      const worn = this.actor.items.filter(other => (other.id !== this.id) && (other.system.slot === "accessory") && other.system.equipped);
      const limit = CONFIG.DEICIDE.slots.accessory.count;
      if ( worn.length >= limit ) updates.push({_id: worn[0].id, "system.equipped": false});
    }
    if ( this.actor ) return this.actor.updateEmbeddedDocuments("Item", updates);
    return this.update({"system.equipped": next});
  }
}
